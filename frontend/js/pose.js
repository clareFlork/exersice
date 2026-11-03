// MediaPipe Pose Landmarker（在瀏覽器內執行，免安裝、影像不會上傳）
const VERSION = "0.10.14";
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

let vision = null;

export async function createPoseDetector() {
  vision = vision || (await import(`${CDN}/vision_bundle.mjs`));
  const { FilesetResolver, PoseLandmarker } = vision;
  const fileset = await FilesetResolver.forVisionTasks(`${CDN}/wasm`);

  const make = (delegate) =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL, delegate },
      runningMode: "VIDEO",
      numPoses: 1,
    });

  let landmarker;
  try {
    landmarker = await make("GPU");
  } catch {
    landmarker = await make("CPU"); // 沒有 WebGL 時改用 CPU
  }

  return {
    detect(videoEl, timestampMs) {
      const result = landmarker.detectForVideo(videoEl, timestampMs);
      return result.landmarks?.[0] || null;
    },
    draw(ctx, landmarks, color = "#22c55e") {
      const utils = new vision.DrawingUtils(ctx);
      utils.drawConnectors(landmarks, vision.PoseLandmarker.POSE_CONNECTIONS, {
        color,
        lineWidth: 4,
      });
      utils.drawLandmarks(landmarks, { color: "#ffffff", fillColor: color, radius: 4, lineWidth: 2 });
    },
  };
}

import { record, text, type Analysis } from "./mistake-contract";

export type Recognition = { recognition: "clear" | "uncertain"; question: string; questionCount: number; uncertainty: string; studentWork: string };
export function parseRecognition(value: unknown): Recognition {
  const raw = record(value);
  const question = text(raw.question, "识别题干", 6000);
  const studentWork = text(raw.studentWork, "识别过程", 4000);
  const questionCount = typeof raw.questionCount === "number" && Number.isInteger(raw.questionCount) && raw.questionCount >= 0 && raw.questionCount <= 20 ? raw.questionCount : 0;
  const uncertainty = text(raw.uncertainty, "识别待核对", 2000);
  const clear = (raw.rotation === 0) && raw.recognition === "clear" && questionCount === 1 && Boolean(question) && !uncertainty && !/需校对|看不清|无法辨认|无法识别/.test(question);
  return { recognition: clear ? "clear" : "uncertain", question, questionCount, studentWork, uncertainty: questionCount > 1 ? "照片包含多道题，请旋转到正向、裁剪到一道题及对应过程后重新上传；不会把多道题拼成一道。" : uncertainty || (clear ? "" : raw.rotation !== 0 ? "照片方向未能可靠校正，请在上传预览中旋转到文字正向后重试。" : "关键题目条件未能可靠识别，请对照原图或补拍局部清晰照片。") };
}
export function recognitionOnly(result: Recognition): Analysis {
  return { version: 1, origin: "ai", diagnosisStatus: "unconfirmed", recognition: "uncertain", question: result.question || "题干尚未识别，请查看原图。", uncertainty: result.uncertainty, recognizedWork: result.studentWork, coreConcept: "", stickingPoint: "题干尚未核对，暂不判断个人卡点。", errorReason: "题干尚未核对，暂不判断错误原因。", method: "", reviewTip: "", nextCheck: "先核对题干的符号、积分上下限与所求量。" };
}

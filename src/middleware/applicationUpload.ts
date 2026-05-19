/* eslint-disable */
import multer from "multer";
import fs from "fs";
import path from "path";

const UPLOAD_DIR = "uploads/applications";
const ALLOWED_EXT = /\.(pdf|jpe?g|png)$/i;
const ALLOWED_MIME = /^(application\/pdf|image\/jpeg|image\/jpg|image\/png)$/i;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${unique}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const extOk = ALLOWED_EXT.test(path.extname(file.originalname));
  const mimeOk = ALLOWED_MIME.test(file.mimetype);
  if (extOk && mimeOk) cb(null, true);
  else cb(new Error("Only PDF, JPG, and PNG files are allowed"));
};

export const applicationDocumentsUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
}).fields([
  { name: "governmentId", maxCount: 1 },
  { name: "proofOfIncome", maxCount: 1 },
  { name: "referenceLetters", maxCount: 1 },
]);

export function buildApplicationDocumentUrl(req: { protocol: string; get: (h: string) => string | undefined }, filename: string): string {
  return `${req.protocol}://${req.get("host")}/uploads/applications/${filename}`;
}

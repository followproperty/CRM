import mongoose, { Schema, Document, Model } from "mongoose";

export interface IImportLog {
  fileName: string;
  fileType: string;
  importedAt: Date;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  duplicateRecords: number;
  insertedRecords: number;
  targetCollection: string;
}

export interface IImportLogDocument extends IImportLog, Document {}

const ImportLogSchema = new Schema<IImportLogDocument>(
  {
    fileName: { type: String, required: true },
    fileType: { type: String, required: true },
    importedAt: { type: Date, default: Date.now },
    totalRecords: { type: Number, default: 0 },
    validRecords: { type: Number, default: 0 },
    invalidRecords: { type: Number, default: 0 },
    duplicateRecords: { type: Number, default: 0 },
    insertedRecords: { type: Number, default: 0 },
    targetCollection: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

const ImportLog: Model<IImportLogDocument> =
  mongoose.models.ImportLog || mongoose.model<IImportLogDocument>("ImportLog", ImportLogSchema, "import_logs");

export default ImportLog;
export { ImportLog };

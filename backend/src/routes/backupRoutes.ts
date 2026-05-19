import express from "express";
import isAuth from "../middleware/isAuth";

import * as BackupController from "../controllers/BackupController";

const routes = express.Router();

routes.get("/backups", isAuth, BackupController.index);
routes.get("/backups/:filename/download", isAuth, BackupController.download);
routes.delete("/backups/:filename", isAuth, BackupController.remove);
routes.post("/backups/generate", isAuth, BackupController.generate);

export default routes;

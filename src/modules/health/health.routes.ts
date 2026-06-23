import { Router } from "express";
import { HealthController } from "./health.controller";

export const HealthRoutes = Router();

HealthRoutes.get("/", HealthController.check);

import { Router } from "express";
import { userController } from "../controllers/user.controller";
import { requireAuth, requireModule } from "../middlewares/auth";

export const userRouter = Router();

userRouter.use(requireAuth, requireModule("manajemen-user"));

userRouter.get("/", userController.list);
userRouter.get("/:id", userController.get);
userRouter.post("/", userController.create);
userRouter.put("/:id", userController.update);
userRouter.delete("/:id", userController.remove);

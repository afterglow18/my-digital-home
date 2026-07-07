import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import clothingRouter from "./clothing";
import outfitsRouter from "./outfits";
import stripeRouter from "./stripe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(clothingRouter);
router.use(outfitsRouter);
router.use(stripeRouter);

export default router;

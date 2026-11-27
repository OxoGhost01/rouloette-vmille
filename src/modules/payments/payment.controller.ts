import type { Request, Response } from "express";
import { currentUser } from "../../fourni/auth/index.js";
import { idParamSchema, parse } from "../../shared/validation.js";
import { toOrderDto } from "../orders/orders.dto.js";
import { payOrderSchema } from "./payment.dto.js";
import type { PaymentService } from "./payment.service.js";

export class PaymentController {
  constructor(private readonly service: PaymentService) {}

  pay = async (req: Request, res: Response) => {
    const { id } = parse(idParamSchema, req.params);
    const { token } = parse(payOrderSchema, req.body);
    res.json(toOrderDto(await this.service.pay(currentUser(req), id, token)));
  };
}

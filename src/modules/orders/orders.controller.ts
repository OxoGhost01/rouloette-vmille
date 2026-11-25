import type { Request, Response } from "express";
import { currentUser } from "../../fourni/auth/index.js";
import { parse } from "../../shared/validation.js";
import { listOrdersQuerySchema, orderIdParamSchema, placeOrderSchema, toOrderDto } from "./orders.dto.js";
import type { OrderService } from "./orders.service.js";

export class OrderController {
  constructor(private readonly service: OrderService) {}

  place = async (req: Request, res: Response) => {
    const order = await this.service.place(currentUser(req), parse(placeOrderSchema, req.body));
    res.status(201).location(`/orders/${order.id}`).json(toOrderDto(order));
  };

  list = async (req: Request, res: Response) => {
    const page = await this.service.list(currentUser(req), parse(listOrdersQuerySchema, req.query));
    res.json({ ...page, items: page.items.map(toOrderDto) });
  };

  get = async (req: Request, res: Response) => {
    const { id } = parse(orderIdParamSchema, req.params);
    res.json(toOrderDto(await this.service.getFor(currentUser(req), id)));
  };
}

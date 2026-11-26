import type { Request, Response } from "express";
import { mapPage } from "../../shared/pagination.js";
import { idParamSchema, parse } from "../../shared/validation.js";
import {
  createDishSchema,
  listDishesQuerySchema,
  toAllergenDto,
  toCategoryDto,
  toDishDto,
  updateDishSchema,
} from "./menu.dto.js";
import type { MenuService } from "./menu.service.js";

export class MenuController {
  constructor(private readonly service: MenuService) {}

  listCategories = async (_req: Request, res: Response) => {
    res.json((await this.service.listCategories()).map(toCategoryDto));
  };

  listAllergens = async (_req: Request, res: Response) => {
    res.json((await this.service.listAllergens()).map(toAllergenDto));
  };

  listDishes = async (req: Request, res: Response) => {
    res.json(mapPage(await this.service.listDishes(parse(listDishesQuerySchema, req.query)), toDishDto));
  };

  getDish = async (req: Request, res: Response) => {
    const { id } = parse(idParamSchema, req.params);
    res.json(toDishDto(await this.service.getDish(id)));
  };

  createDish = async (req: Request, res: Response) => {
    const dish = await this.service.createDish(parse(createDishSchema, req.body));
    res.status(201).location(`/dishes/${dish.id}`).json(toDishDto(dish));
  };

  updateDish = async (req: Request, res: Response) => {
    const { id } = parse(idParamSchema, req.params);
    res.json(toDishDto(await this.service.updateDish(id, parse(updateDishSchema, req.body))));
  };

  deleteDish = async (req: Request, res: Response) => {
    const { id } = parse(idParamSchema, req.params);
    await this.service.deleteDish(id);
    res.status(204).end();
  };
}

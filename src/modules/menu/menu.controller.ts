import type { Request, Response } from "express";
import { parse } from "../../shared/validation.js";
import { idParamSchema, listDishesQuerySchema, toAllergenDto, toCategoryDto, toDishDto } from "./menu.dto.js";
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
    const page = await this.service.listDishes(parse(listDishesQuerySchema, req.query));
    res.json({ ...page, items: page.items.map(toDishDto) });
  };

  getDish = async (req: Request, res: Response) => {
    const { id } = parse(idParamSchema, req.params);
    res.json(toDishDto(await this.service.getDish(id)));
  };
}

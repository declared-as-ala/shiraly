import type { ProductService } from './product-service';
import type { CategoryService } from './category-service';
import type { OrderService } from './order-service';
import { MongoProductService } from './mongo/mongo-product-service';
import { MongoCategoryService } from './mongo/mongo-category-service';
import { MongoOrderService } from './mongo/mongo-order-service';

export const productService: ProductService = new MongoProductService();
export const categoryService: CategoryService = new MongoCategoryService();
export const orderService: OrderService = new MongoOrderService();

export type { ProductService } from './product-service';
export type { CategoryService } from './category-service';
export type { OrderService } from './order-service';

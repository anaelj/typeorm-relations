import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerFound = await this.customersRepository.findById(customer_id);

    if (!customerFound) {
      throw new AppError('Could not create order, customer dont exists');
    }

    //    console.log('aqui1..');

    const productFound = await this.productsRepository.findAllById(products);

    //    console.log('aqui2..');
    // console.log(products);
    // console.log('aqui..');

    if (!productFound.length) {
      throw new AppError('Could not create order, product dont exists');
    }

    const productFoundIds = productFound.map(product => product.id);
    const checkInproductFound = products.filter(
      product => !productFoundIds.includes(product.id),
    );

    if (checkInproductFound.length) {
      throw new AppError(`Could not find product ${checkInproductFound[0].id}`);
    }

    const findProductsWithNoQuantityAvailable = products.filter(
      product =>
        productFound.filter(p => p.id === product.id)[0].quantity <=
        product.quantity,
    );

    if (findProductsWithNoQuantityAvailable.length) {
      throw new AppError(
        `The quantity ${findProductsWithNoQuantityAvailable[0].quantity} is not available for ${findProductsWithNoQuantityAvailable[0].id}`,
      );
    }
    const formattedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: productFound.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerFound,
      products: formattedProducts,
    });

    const { order_products } = order;

    const orderedProductsQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        productFound.filter(p => p.id === product.product_id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProductsQuantity);

    return order;
  }
}

export default CreateOrderService;

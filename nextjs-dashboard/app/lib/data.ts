import { unstable_noStore as noStore } from 'next/cache';
import { sql } from '@vercel/postgres';
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  User,
  Revenue,
	Invoice,
	Customer,
	LatestInvoice,
} from './definitions';
import { formatCurrency } from './utils';
import axios from 'axios';
import { revenue, customers, users, invoices } from './placeholder-data';

const BASE_URL = process.env.MOCKAPI_BASE_URL;

export const API_ROUTES = {
  REVENUE: BASE_URL + '/revenue',
  CUSTOMER: BASE_URL + '/customers',
  USER: BASE_URL + '/users',
  INVOICE: BASE_URL + '/invoices',
}

export async function fetchRevenue() {
  // Add noStore() here prevent the response from being cached.
  // This is equivalent to in fetch(..., {cache: 'no-store'}).
	noStore();

  try {
    // Artificially delay a response for demo purposes.
    // Don't do this in production :)

    // console.log('Fetching revenue data...');
    // await new Promise((resolve) => setTimeout(resolve, 3000));

    // const data = await sql<Revenue>`SELECT * FROM revenue`;

    // console.log('Data fetch completed after 3 seconds.');
    
    // return data.rows;
    return revenue;

		// const response = await axios.get(API_ROUTES.REVENUE);

  	// return response.data;

  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
	noStore();

	try {
		// const { data: invoices } = await axios.get<Invoice[]>(API_ROUTES.INVOICE);
		// const { data: customers } = await axios.get<Customer[]>(API_ROUTES.CUSTOMER);

		return invoices.map(({ customer_id , amount}) => {
			let result = {} as LatestInvoice;
			
			customers.forEach(({id, image_url, email, name}) => {
				if (id === customer_id) {
					result = {
						id,
						image_url,
						email,
						name,
						amount: formatCurrency(amount)
					}
				}
			});

			return result
		}).slice(0,5);
  } catch (error) {
    throw new Error('Failed to fetch the latest invoices.');
  }
}

export async function fetchCardData() {
	noStore();

  try {
		// const [{data: invoices}, {data: customers}] = await Promise.all([
    //   axios.get<Invoice[]>(API_ROUTES.INVOICE),
    //   axios.get<Customer[]>(API_ROUTES.CUSTOMER),
    // ]);

		const {totalPaidInvoices, totalPendingInvoices
		} = invoices.reduce((accumulator, { status, amount }) => ({
				totalPaidInvoices: (status === 'paid' ? amount : 0) + accumulator.totalPaidInvoices,
				totalPendingInvoices: (status === 'pending' ? amount : 0) + accumulator.totalPendingInvoices,
		}), {totalPaidInvoices: 0, totalPendingInvoices: 0});

		return {
      numberOfInvoices: invoices.length || 0,
			numberOfCustomers: customers.length || 0,
      totalPaidInvoices: formatCurrency(totalPaidInvoices),
      totalPendingInvoices: formatCurrency(totalPendingInvoices)
		};
		
  } catch (error) {
    throw new Error('Failed to fetch card data.');
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
) {
	noStore();

  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    // const { data: invoices } = await axios.get<Invoice[]>(API_ROUTES.INVOICE);
    // const { data: customers } = await axios.get<Customer[]>(API_ROUTES.CUSTOMER);

    const results = invoices.map((invoice) => {
      const customer = customers.find(({id}) => id === invoice.customer_id);

	    return {
        ...invoice,
        ...customer,
		  };
		}) as InvoicesTable[];

    return results?.filter(({name = '', email = '', amount, date, status}) => 
      name.search(query) >= 0
      || email.search(query) >= 0
      || amount.toString().search(query) >= 0
      || status.search(query) >= 0
      || date.search(query) >= 0
    ).slice(offset, offset + ITEMS_PER_PAGE );
  } catch (error) {
    throw new Error('Failed to fetch invoices.');
  }
}

export async function fetchInvoicesPages(query: string) {
	noStore();

  try {
    // const { data: invoices } = await axios.get<Invoice[]>(API_ROUTES.INVOICE);

    const totalPages = Math.ceil(invoices.length / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    throw new Error('Failed to fetch total number of invoices.');
  }
}

export async function fetchInvoiceById(id: string) {
	noStore();

  try {
    // const { data: invoices1 } = await axios.get<Invoice[]>(API_ROUTES.INVOICE + '/126eed9c-c90c-4ef6-a4a8-fcf7408d3c661');

    const invoice = invoices.find((invoice) => (invoice.id === id)) || {};

    return invoice as Invoice;
  } catch (error) {
    throw new Error('Failed to fetch invoice.');
  }
}

export async function fetchCustomers() {
	noStore();

  try {
    // const { data: customers } = await axios.get<Customer[]>(API_ROUTES.CUSTOMER);
    
    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

export async function fetchFilteredCustomers(query: string) {
	noStore();

  try {
    const data = await sql<CustomersTableType>`
		SELECT
		  customers.id,
		  customers.name,
		  customers.email,
		  customers.image_url,
		  COUNT(invoices.id) AS total_invoices,
		  SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
		  SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
		FROM customers
		LEFT JOIN invoices ON customers.id = invoices.customer_id
		WHERE
		  customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`}
		GROUP BY customers.id, customers.name, customers.email, customers.image_url
		ORDER BY customers.name ASC
	  `;

    const customers = data.rows.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}

export async function getUser(email: string) {
	noStore();

  try {
    const user = await sql`SELECT * FROM users WHERE email=${email}`;
    return user.rows[0] as User;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}

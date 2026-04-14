# AC Inventory System

## Summary

AC Inventory is a small procedural PHP application for managing retail and wholesale inventory, sales, and customer debts. It uses MySQL through the `mysqli` extension and is built to run on a local PHP server with database name `acinventory`.

The repository contains two copies of the same app structure:
- `pages/`
- `imgs/pages/`

For rebuild purposes, use `pages/` as the primary version and note that `imgs/pages/` appears to be duplicated code.

---

## Architecture

### High-level request flow

1. User loads a UI page in the browser.
2. Page may render data from the database using `connect.php`.
3. Forms submit `POST` requests to `allforms.php`.
4. `allforms.php` routes the request based on submitted button names.
5. `function.php` executes the business logic and database operations.
6. On success or error, the handler sets `$_SESSION` flash messages and redirects back to a UI page.

### Important patterns

- Central dispatcher: `pages/allforms.php` is the single entry point for form actions.
- Business logic lives in `pages/function.php`.
- Database connection is established in `pages/connect.php`.
- User state is tracked in PHP session variables:
  - `$_SESSION['login']` for retail workers
  - `$_SESSION['Admin']` for admin access
- UI pages include one of two sidebars for access control:
  - `pages/sidebar.php` for admin
  - `pages/sidebar_r.php` for retail users

---

## System Roles

### Admin

- Logs in with hardcoded credentials: `AC368_SYS / AC368_SYS`
- Accesses admin inventory management pages:
  - `product.php` — retail inventory administration
  - `wholesale_admin.php` — wholesale inventory administration
  - `admin_sales.php` — admin sales report
  - `customer.php` — client management
  - `workers.php` — worker management
  - `reversals.php` — view and manage reversed sales

### Worker / Retail user

- Logs in using records from `workers` table.
- Accesses sales pages:
  - `retail.php` — retail product sales, cart, and checkout
  - `wholesale.php` — wholesale sales, cart, and client payment tracking
  - `sales.php` — retail sales history and reversals

---

## File-by-file Overview

### `pages/connect.php`

Database connection file. It creates a `mysqli` connection using:
- host: `localhost`
- username: `root`
- password: ``
- database: `acinventory`

This connection is included into pages and functions before executing SQL.

### `pages/function.php`

Contains nearly all business logic. Key sections:

#### Authentication
- `login()`
  - validates worker credentials against `workers` table
  - sets `$_SESSION['login']` on success
  - falls back to hardcoded admin credentials and sets `$_SESSION['Admin']`

#### Product and inventory management
- `addprod()` — add retail product
- `addprod_whsl()` — add wholesale product
- `add_mr_prod()` / `add_mr_prod_whlsl()` — add more stock quantity
- `edit_prod()` / `edit_prod_whlsl()` — update product metadata
- `DeleteProd()` / `DeleteProdWhlsl()` — delete products

#### Client and worker management
- `addclient()` — add a wholesale client
- `addwrkr()` — add a worker account
- `edit_cus()` — update client details
- `del_cus()` / `del_wrk()` — delete clients or workers

#### Cart management
- `CartForm()` — add retail item to cart or increment quantity
- `cart_by_unit_Form()` — add retail item to cart using unit quantity
- `WhlslCartForm()` — add wholesale item to cart
- `AddMoreCrt()` / `MinusCrt()` — increment or decrement retail cart quantities
- `add_to_crt_wls()` / `MinusCrtWhlsl()` — increment or decrement wholesale cart quantities
- `CartDel()` / `CartDelWhlsl()` — remove single cart item
- `EmptyCrt()` / `EmptyCrtWhlsl()` — clear the cart

#### Checkout and sales
- `SellFrmCrt()` — process retail cart checkout
  - deduct stock from `products`
  - insert sales rows into `sales`
  - remove cart items
- `SellFrmCrtWhlsl()` — process wholesale cart checkout
  - requires selected client
  - deduct stock from `wholesale`
  - insert `clients_sales` and `whlslsales`
  - calculate profit, amount paid, and debt
  - clear wholesale cart

#### Debt and reverse operations
- `pay_debt()` — update wholesale sale payment and debt status
- `ReversProd()` — reverse a retail sale
  - restore product quantity
  - delete matching `sales` row
  - log reversal into `reverse`

### `pages/allforms.php`

Acts as a form action router. It does not contain business logic itself, only conditional routing.

Example mapping:
- `$_POST['login']` → `login()`
- `$_POST['addprod']` → `addprod()`
- `$_POST['cart']` → `CartForm()`
- `$_POST['cart_whsl']` → `WhlslCartForm()`
- `$_POST['sll_frm_crt']` → `SellFrmCrt()`
- `$_POST['sll_frm_crt_whlsl']` → `SellFrmCrtWhlsl()`
- `$_POST['pay_debt']` → `pay_debt()`
- `$_POST['rev_prod']` → `ReversProd()`

---

## User Interfaces and Pages

### `pages/index.php`

- Login page
- Submits credentials to `allforms.php`
- Displays session flash messages for login failures

### `pages/retail.php`

Retail sales page:
- lists `products`
- shows stock status, low stock warnings, and cart quantity badges
- enables adding products to the retail cart
- uses `sidebar_r.php`

### `pages/wholesale.php`

Wholesale sales page:
- lists `wholesale` inventory
- lets the user add items to the wholesale cart
- requires selecting a client for checkout
- shows cart totals and sale history

### `pages/product.php`

Admin retail inventory dashboard:
- lists products and inventory totals
- provides forms to add or update product metadata

### `pages/wholesale_admin.php`

Admin wholesale inventory dashboard

### `pages/admin_sales.php`

Admin reporting page for sales totals and product summaries

### `pages/customer.php`

Client management interface

### `pages/workers.php`

Worker account management interface

### `pages/sales.php`

Retail sales history page:
- filter by date
- reverse individual retail sales

### `pages/reversals.php`

Page for viewing reversed sales actions

---

## Data Model and Tables

The following tables are implied by the code and should exist in the database.

### Inventory and product tables

- `products`
  - retail product catalog and stock
  - fields: `id`, `pname`, `qnty`, `q_qnty`, `cst_prc`, `sll_prc`, `unit`, `cat`, `fst_date`, `last_qnty`

- `wholesale`
  - wholesale product catalog
  - fields similar to `products`

- `units`
  - unit-based pricing for products
  - fields: `p_id`, `u_name`, `price`, `qnty`

### Cart tables

- `cart`
  - retail cart items
  - fields: `pro_id`, `p_name`, `qnty`, `unit_price`, `overall_price`, `unit`, `date_sold`, `time_sold`

- `wholesale_cart`
  - wholesale cart items
  - same fields as `cart`

### Sales and revenue tables

- `sales`
  - retail sales records
  - fields: `p_id`, `p_name`, `cost_pr`, `unit_price`, `overall_price`, `qnty`, `time_sold`, `date_sold`

- `whlslsales`
  - wholesale sales records
  - fields: `p_id`, `p_name`, `cost_pr`, `unit_price`, `overall_price`, `qnty`, `amnt_paid`, `prof`, `dept`, `client_id`, `time_sold`, `date_sold`, `mon_sld`

- `clients_sales`
  - high-level wholesale invoices
  - fields: `client_id`, `sale_date`, `mon_sld`

### Customer and account tables

- `clients`
  - wholesale customers / clients
  - fields: `cus_name`, `e_name`, `contact`, `cus_location`, `cus_date`

- `workers`
  - worker login accounts
  - fields: `wrk_name`, `pass`, `email`, `contact`, `wrk_date`

### Debt and reversal tracking

- `debts`
  - tracks payments toward wholesale debts
  - fields: `salesid`, `amnt_paid`, `old_debt`, `d_date`, `d_time`

- `reverse`
  - records reversed retail sales
  - fields: `p_id`, `qnty`, `overall_price`

---

## Rebuild Guidance for Claude

To rebuild this system, preserve these core capabilities:

1. Authentication
   - worker login via `workers` table
   - admin login via hardcoded credentials or replace with admin table
2. Product management
   - add, edit, delete retail and wholesale products
   - support stock top-up / quantity additions
3. Cart workflow
   - retail cart operations: add, increment, decrement, delete, empty
   - wholesale cart operations: same as retail, plus client selection
4. Checkout and sales
   - retail checkout deducts stock, saves sales, clears cart
   - wholesale checkout deducts stock, saves client sales, tracks payment and debt
5. Debt management
   - accept partial payments and update remaining debt
   - log payment history
6. Reversal process
   - allow reversing retail sales and restore stock

Implementation details to keep or improve:
- Use a single routing entrypoint for form actions or convert to a simple MVC-style router.
- Preserve session-based UI flash messaging.
- Maintain use of Bootstrap-based HTML for pages.
- Keep the same database table names if rebuilding the same schema.

---

## Known Weaknesses

These are critical if rebuilding with better quality:
- SQL injection risk due to direct interpolation of `$_POST` values
- plaintext password storage for workers
- root user with empty database password
- lack of CSRF protection
- duplicated code under `imgs/pages/`
- inconsistent inventory checks in cart logic

---

## Practical Notes

- The `pages/` folder is the effective application source.
- `imgs/pages/` appears to be a copy and should be ignored or removed during rebuild.
- `allforms.php` is the main controller and should be the first file to read when understanding request routing.
- `function.php` is the main logic file and contains the full domain behavior.

If needed, the next step is to produce the exact SQL schema for `acinventory` by inspecting the database or inferring column names and types from the code.

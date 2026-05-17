export type Step = "form" | "summary" | "review" | "payment" | "success" | "error";
export type PaymentMethod = "card" | "cash_on_delivery" | "paypal";

export interface CustomerForm {
  name: string;
  email: string;
  phone: string;
  street: string;
  house_number: string;
  city: string;
  postal_code: string;
  message: string;
}

export const EMPTY_FORM: CustomerForm = {
  name: "",
  email: "",
  phone: "",
  street: "",
  house_number: "",
  city: "",
  postal_code: "",
  message: "",
};

export const DELIVERY_FEE = 2.5;

export const fmt = (n?: number | null) =>
  Number(n ?? 0).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
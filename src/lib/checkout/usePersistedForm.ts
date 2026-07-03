// lib/checkout/usePersistedForm.ts
"use client";

import { useEffect, useState } from "react";
import { saveToStorage, loadFromStorage, clearStorage } from "@/lib/storage/localCache";
import type { CustomerForm } from "@/components/checkout/checkout.types";

const FORM_KEY = "checkout:form";
const FORM_TTL_MS = 1000 * 60 * 60 * 6; // 6h

const emptyForm: CustomerForm = {
  name: "",
  phone: "",
  email: "",
  street: "",
  house_number: "",
  postal_code: "",
  city: "",
  message: "",
};

export function usePersistedForm() {
  const [form, setForm] = useState<CustomerForm>(() => {
    return loadFromStorage<CustomerForm>(FORM_KEY) ?? emptyForm;
  });

  useEffect(() => {
    saveToStorage(FORM_KEY, form, FORM_TTL_MS);
  }, [form]);

  const updateField = (key: keyof CustomerForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const resetForm = () => {
    setForm(emptyForm);
    clearStorage(FORM_KEY);
  };

  return { form, updateField, resetForm };
}
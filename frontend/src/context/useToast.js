import { useContext } from "react";
import { ToastContext } from "./ToastContext.jsx";

export function useToast() {
  return useContext(ToastContext);
}

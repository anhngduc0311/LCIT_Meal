import { useContext } from "react";
import { ConfirmContext } from "../context/ConfirmContext";

// Dùng: const confirm = useConfirm(); const ok = await confirm({ message: "..." });
export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return context.confirm;
};

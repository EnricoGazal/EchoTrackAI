import { createContext, useContext } from "react";

// O que qualquer tela precisa: navegar, tocar, abrir a busca e saber quem é o usuário.
export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

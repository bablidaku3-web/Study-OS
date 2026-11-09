import styles from "./mistakes.module.css";
import { ReactNode } from "react";
export default function MistakesLayout({ children }: { children: ReactNode }) { return <div className={styles.root}>{children}</div>; }

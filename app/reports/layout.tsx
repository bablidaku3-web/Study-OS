import styles from "./reports.module.css";
import { ReactNode } from "react";
export default function ReportsLayout({children}:{children:ReactNode}){return <div className={styles.root}>{children}</div>;}

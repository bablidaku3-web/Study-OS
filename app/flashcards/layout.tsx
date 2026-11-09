import styles from "./flashcards.module.css";
import { ReactNode } from "react";
export default function FlashcardsLayout({children}:{children:ReactNode}){return <div className={styles.root}>{children}</div>;}

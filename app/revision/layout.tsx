import styles from "./revision.module.css";
import { ReactNode } from "react";
export default function RevisionLayout({ children }: { children: ReactNode }) { return <div className={styles.root}>{children}</div>; }

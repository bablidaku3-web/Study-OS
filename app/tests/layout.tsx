import styles from "./tests.module.css";
import { ReactNode } from "react";

export default function TestsLayout({ children }: { children: ReactNode }) { return <div className={styles.testRoot}>{children}</div>; }

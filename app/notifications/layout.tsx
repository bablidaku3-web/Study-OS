import styles from "./notifications.module.css";import {ReactNode} from "react";export default function Layout({children}:{children:ReactNode}){return <div className={styles.root}>{children}</div>;}

import "./style.css";
import { mountProfile } from "./profile";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app not found");

mountProfile(app);


import "./css/main.css"
import MainUI from "./ui/main"

window.onload = () => {
    let body = document.getElementsByTagName("body")[0];
    let head = document.getElementsByTagName("head")[0];

    let main = new MainUI(body, head);
    main.init();
}
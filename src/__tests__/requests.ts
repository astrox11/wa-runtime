import { get, post } from "../client/request.js";

async function make_network_requests_test() {
    get("https://jsonplaceholder.typicode.com/todos/1")
        .then((response) => response.body)
        .then((data) => {
            console.info("Network Request Test Successful:", data);
        })
        .catch((error) => {
            console.error("Network Request Test Failed:", error);
        });

    post("https://jsonplaceholder.typicode.com/posts", { title: 'foo', body: 'bar', userId: 1 })
        .then((response) => response.body)
        .then((data) => {
            console.info("POST Request Test Successful:", data);
        })
        .catch((error) => {
            console.error("POST Request Test Failed:", error);
        });
}

make_network_requests_test();
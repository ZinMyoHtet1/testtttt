import express from "express";
import { sep, join } from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";

const __dirname = join(fileURLToPath(import.meta.url), ".." + sep);
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + "/public"));

app.get("/", function (request, response) {
  response.sendFile(__dirname + "/index.html");
});

app.post("/", function (req, res) {
  console.log(req.body);
  const firstNum = +req.body.n1;
  const secondNum = +req.body.n2;
  const result = firstNum + secondNum;
  res.send("The result is " + result);
});

app.get("/weather", function (req, res) {
  res.sendFile(__dirname + "/public/routes/weather.html");
});

app.listen(3000, function () {
  console.log("Your server is running on port 3000");
});

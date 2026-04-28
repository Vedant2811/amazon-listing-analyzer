require("dotenv").config();  // ← add this line at the top
const express = require("express");
const app = express();
const analyze = require("./api/analyze");

app.use(express.json());
app.use(express.static("public"));
app.post("/api/analyze", analyze);

app.listen(3000, () => console.log("Running on http://localhost:3000"));
const express = require("express");
const fs = require("fs");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const DATA_FILE = "noticias.json";

function carregarNoticias() {
  if (fs.existsSync(DATA_FILE)) {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  }
  return [];
}

app.get("/noticias", (req, res) => {
  res.json(carregarNoticias());
});

app.post("/noticias", (req, res) => {
  const noticias = carregarNoticias();
  const { titulo, conteudo, autor } = req.body;

  if (!titulo || !conteudo || !autor) {
    return res.status(400).json({ error: "Campos obrigatórios: titulo, conteudo, autor" });
  }

  const novaNoticia = {
    id: Date.now(),
    titulo,
    conteudo,
    autor,
    data: new Date().toISOString()
  };

  noticias.push(novaNoticia);
  fs.writeFileSync(DATA_FILE, JSON.stringify(noticias, null, 2));

  res.status(201).json(novaNoticia);
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

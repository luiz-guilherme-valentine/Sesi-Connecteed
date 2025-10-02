const express = require("express");
const multer = require("multer");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Usamos memória para armazenar notícias temporariamente
let noticias = [];
const upload = multer();

// --- ROTAS ---
// Listar notícias
app.get("/noticias", (req, res) => {
  res.json(noticias);
});

// Criar notícia (envio de FormData)
app.post("/noticias", upload.fields([
  { name: "pdf", maxCount: 1 },
  { name: "capa", maxCount: 1 }
]), (req, res) => {
  const { titulo, autor, conteudo } = req.body;
  if (!titulo || !autor) return res.status(400).json({ error: "Título e autor obrigatórios" });

  const id = Date.now().toString();
  const noticia = {
    id,
    titulo,
    autor,
    conteudo: conteudo || "",
    capa: req.files.capa ? req.files.capa[0].buffer.toString("base64") : null,
    pdf: req.files.pdf ? req.files.pdf[0].buffer.toString("base64") : null
  };

  noticias.push(noticia);
  res.json({ message: "Notícia criada", id });
});

// Deletar notícia
app.delete("/noticias/:id", (req, res) => {
  const index = noticias.findIndex(n => n.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Notícia não encontrada" });
  noticias.splice(index, 1);
  res.json({ message: "Notícia deletada" });
});

// Rodando servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

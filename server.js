const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 10000;

// Configuração do Multer (upload de PDFs)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath);
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage: storage });

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// "Banco de dados" simples em memória
let noticias = [];

// Rota para listar notícias
app.get("/noticias", (req, res) => {
  res.json(noticias);
});

// Rota para adicionar notícia
app.post("/noticias", upload.single("pdf"), (req, res) => {
  const { titulo, conteudo, autor } = req.body;
  let pdfUrl = null;

  if (req.file) {
    pdfUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  }

  const noticia = {
    id: noticias.length + 1,
    titulo,
    conteudo,
    autor,
    pdfUrl,
    data: new Date()
  };

  noticias.push(noticia);
  res.json(noticia);
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

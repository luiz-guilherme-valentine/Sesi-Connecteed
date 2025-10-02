const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("uploads"));

const DATA_FILE = "./data/noticias.json";

// Garante que a pasta de dados existe
if (!fs.existsSync("./data")) fs.mkdirSync("./data");
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]");

// Configuração do Multer (upload de capa e PDF)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = "uploads/";
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

// Rota: obter todas as notícias
app.get("/api/noticias", (req, res) => {
  fs.readFile(DATA_FILE, "utf8", (err, data) => {
    if (err) return res.status(500).send("Erro ao ler notícias.");
    res.send(JSON.parse(data));
  });
});

// Rota: adicionar notícia
app.post("/api/noticias", upload.fields([{ name: "pdf" }, { name: "capa" }]), (req, res) => {
  const { titulo, autor, conteudo } = req.body;
  const pdf = req.files["pdf"] ? req.files["pdf"][0].filename : null;
  const capa = req.files["capa"] ? req.files["capa"][0].filename : null;

  const noticia = {
    id: Date.now().toString(),
    titulo,
    autor,
    conteudo: conteudo || "",
    pdf,
    capa
  };

  fs.readFile(DATA_FILE, "utf8", (err, data) => {
    if (err) return res.status(500).send("Erro ao salvar notícia.");
    const noticias = JSON.parse(data);
    noticias.push(noticia);
    fs.writeFile(DATA_FILE, JSON.stringify(noticias, null, 2), (err) => {
      if (err) return res.status(500).send("Erro ao salvar notícia.");
      res.send(noticia);
    });
  });
});

// Rota: deletar notícia
app.delete("/api/noticias/:id", (req, res) => {
  const id = req.params.id;

  fs.readFile(DATA_FILE, "utf8", (err, data) => {
    if (err) return res.status(500).send("Erro ao ler notícias.");

    let noticias = JSON.parse(data);
    const index = noticias.findIndex(n => n.id === id);

    if (index === -1) {
      return res.status(404).send("Notícia não encontrada.");
    }

    // Deleta os arquivos associados (PDF e capa)
    const noticia = noticias[index];
    if (noticia.pdf && fs.existsSync(path.join("uploads", noticia.pdf))) {
      fs.unlinkSync(path.join("uploads", noticia.pdf));
    }
    if (noticia.capa && fs.existsSync(path.join("uploads", noticia.capa))) {
      fs.unlinkSync(path.join("uploads", noticia.capa));
    }

    noticias.splice(index, 1);

    fs.writeFile(DATA_FILE, JSON.stringify(noticias, null, 2), (err) => {
      if (err) return res.status(500).send("Erro ao salvar exclusão.");
      res.send({ success: true });
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor rodando na porta " + PORT));

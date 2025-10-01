const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const unzipper = require("unzipper");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

let noticias = []; // Armazena as notícias em memória
let idCounter = 1;

// Configuração de uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});
const upload = multer({ storage });

// Criar notícia
app.post("/noticias", upload.fields([{ name: "pdf" }, { name: "capa" }]), (req, res) => {
  const { titulo, conteudo, autor } = req.body;
  const pdf = req.files["pdf"] ? "/uploads/" + req.files["pdf"][0].filename : null;
  const capa = req.files["capa"] ? "/uploads/" + req.files["capa"][0].filename : null;

  const noticia = { id: idCounter++, titulo, conteudo, autor, pdf, capa, data: new Date() };
  noticias.push(noticia);
  res.json(noticia);
});

// Listar notícias
app.get("/noticias", (req, res) => res.json(noticias));

// Deletar notícia
app.delete("/noticias/:id", (req, res) => {
  const id = parseInt(req.params.id);
  noticias = noticias.filter(n => n.id !== id);
  res.sendStatus(200);
});

// Backup
app.get("/backup", async (req, res) => {
  const backupPath = path.join(__dirname, "backup.zip");
  const output = fs.createWriteStream(backupPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  output.on("close", () => {
    res.setHeader("Content-Disposition", "attachment; filename=backup-noticias.zip");
    res.setHeader("Content-Type", "application/zip");
    res.download(backupPath, "backup-noticias.zip", () => {
      fs.unlinkSync(backupPath);
    });
  });

  archive.pipe(output);
  noticias.forEach(noticia => {
    const folder = `noticia-${noticia.id}`;
    archive.append(`Título: ${noticia.titulo}\nAutor: ${noticia.autor}\nConteúdo: ${noticia.conteudo || ""}`, { name: `${folder}/info.txt` });
    if (noticia.pdf && fs.existsSync(path.join(__dirname, noticia.pdf))) {
      archive.file(path.join(__dirname, noticia.pdf), { name: `${folder}/pdf.pdf` });
    }
    if (noticia.capa && fs.existsSync(path.join(__dirname, noticia.capa))) {
      archive.file(path.join(__dirname, noticia.capa), { name: `${folder}/capa${path.extname(noticia.capa)}` });
    }
  });
  archive.finalize();
});

// Restaurar backup
app.post("/restore", upload.single("backup"), async (req, res) => {
  if (!req.file) return res.status(400).send("Nenhum arquivo enviado");
  const zipPath = req.file.path;

  fs.createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: path.join(__dirname, "restaurado") }))
    .on("close", () => {
      // Aqui você poderia recarregar notícias restauradas em memória
      fs.unlinkSync(zipPath);
      res.send("Backup restaurado");
    });
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

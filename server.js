import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import archiver from "archiver";
import unzipper from "unzipper";

const app = express();
const PORT = process.env.PORT || 3000;

const __dirname = path.resolve();
const noticiasFile = path.join(__dirname, "noticias.json");
const noticiasDir = path.join(__dirname, "noticias");

// Middleware
app.use(express.json());
app.use("/noticias", express.static(noticiasDir));

// Configuração do upload (PDF + capa)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, noticiasDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  }
});
const upload = multer({ storage });

// Inicializa JSON se não existir
if (!fs.existsSync(noticiasFile)) {
  fs.writeFileSync(noticiasFile, "[]");
}
if (!fs.existsSync(noticiasDir)) {
  fs.mkdirSync(noticiasDir);
}

// GET todas as notícias
app.get("/noticias", (req, res) => {
  const noticias = JSON.parse(fs.readFileSync(noticiasFile, "utf-8"));
  res.json(noticias);
});

// POST nova notícia
app.post("/noticias", upload.fields([{ name: "pdf" }, { name: "capa" }]), (req, res) => {
  const noticias = JSON.parse(fs.readFileSync(noticiasFile, "utf-8"));

  const { titulo, autor, conteudo } = req.body;
  if (!titulo || !autor) {
    return res.status(400).json({ error: "Título e Autor são obrigatórios" });
  }

  const id = Date.now();
  const pdfFile = req.files["pdf"] ? req.files["pdf"][0].filename : null;
  const capaFile = req.files["capa"] ? req.files["capa"][0].filename : null;

  const noticia = {
    id,
    titulo,
    autor,
    conteudo,
    pdf: pdfFile,
    capa: capaFile
  };

  noticias.push(noticia);
  fs.writeFileSync(noticiasFile, JSON.stringify(noticias, null, 2));

  res.json(noticia);
});

// DELETE notícia
app.delete("/noticias/:id", (req, res) => {
  const id = parseInt(req.params.id);
  let noticias = JSON.parse(fs.readFileSync(noticiasFile, "utf-8"));

  const noticia = noticias.find(n => n.id === id);
  if (!noticia) return res.status(404).json({ error: "Notícia não encontrada" });

  // remove arquivos associados
  if (noticia.pdf) {
    fs.unlinkSync(path.join(noticiasDir, noticia.pdf));
  }
  if (noticia.capa) {
    fs.unlinkSync(path.join(noticiasDir, noticia.capa));
  }

  noticias = noticias.filter(n => n.id !== id);
  fs.writeFileSync(noticiasFile, JSON.stringify(noticias, null, 2));

  res.json({ success: true });
});

// GET capa
app.get("/noticias/:id/capa", (req, res) => {
  const id = parseInt(req.params.id);
  const noticias = JSON.parse(fs.readFileSync(noticiasFile, "utf-8"));
  const noticia = noticias.find(n => n.id === id);

  if (noticia && noticia.capa) {
    res.sendFile(path.join(noticiasDir, noticia.capa));
  } else {
    res.status(404).send("Capa não encontrada");
  }
});

// GET PDF
app.get("/noticias/:id/arquivo.pdf", (req, res) => {
  const id = parseInt(req.params.id);
  const noticias = JSON.parse(fs.readFileSync(noticiasFile, "utf-8"));
  const noticia = noticias.find(n => n.id === id);

  if (noticia && noticia.pdf) {
    res.sendFile(path.join(noticiasDir, noticia.pdf));
  } else {
    res.status(404).send("PDF não encontrado");
  }
});

// Backup
app.get("/backup", (req, res) => {
  const zipPath = path.join(__dirname, "backup-noticias.zip");
  const output = fs.createWriteStream(zipPath);
  const archive = archiver("zip");

  output.on("close", () => {
    res.download(zipPath, "backup-noticias.zip", () => {
      fs.unlinkSync(zipPath); // apaga depois de enviar
    });
  });

  archive.pipe(output);
  archive.file(noticiasFile, { name: "noticias.json" });
  archive.directory(noticiasDir, "noticias");
  archive.finalize();
});

// Restore backup
app.post("/restore", upload.single("backup"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });

  const zipPath = req.file.path;

  fs.createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: __dirname }))
    .on("close", () => {
      fs.unlinkSync(zipPath);
      res.json({ success: true });
    });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

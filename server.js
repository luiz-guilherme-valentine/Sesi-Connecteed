const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const archiver = require("archiver");
const unzipper = require("unzipper");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

// Arquivo persistente
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "noticias.json");

// Garantir diretório
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]");

// Middleware upload
const upload = multer({ dest: "uploads/" });

// --- API ---
app.get("/noticias", (req, res) => {
  const noticias = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  res.json(noticias);
});

app.post("/noticias", (req, res) => {
  const noticias = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const noticia = {
    id: Date.now(),
    titulo: req.body.titulo,
    autor: req.body.autor,
    pdf: req.body.pdf || "",
    data: new Date()
  };
  noticias.push(noticia);
  fs.writeFileSync(DATA_FILE, JSON.stringify(noticias, null, 2));
  res.json({ ok: true });
});

// --- BACKUP ---
app.get("/backup", (req, res) => {
  const noticias = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

  res.setHeader("Content-Disposition", "attachment; filename=backup.zip");
  res.setHeader("Content-Type", "application/zip");

  const archive = archiver("zip");
  archive.pipe(res);

  noticias.forEach(n => {
    const folder = `noticia_${n.id}`;
    const txt = `Titulo: ${n.titulo}\nAutor: ${n.autor}\nData: ${n.data}`;
    archive.append(txt, { name: `${folder}/info.txt` });

    if (n.pdf && fs.existsSync(n.pdf)) {
      archive.file(n.pdf, { name: `${folder}/arquivo.pdf` });
    }
  });

  archive.finalize();
});

// --- RESTORE ---
app.post("/restore", upload.single("backup"), async (req, res) => {
  const noticias = [];

  fs.createReadStream(req.file.path)
    .pipe(unzipper.Parse())
    .on("entry", async entry => {
      const filePath = entry.path;
      if (filePath.endsWith("info.txt")) {
        const content = await entry.buffer();
        const [titulo, autor] = content.toString().split("\n");
        noticias.push({
          id: Date.now() + Math.random(),
          titulo: titulo.replace("Titulo: ", ""),
          autor: autor.replace("Autor: ", ""),
          pdf: "",
          data: new Date()
        });
      } else {
        entry.autodrain();
      }
    })
    .on("close", () => {
      fs.writeFileSync(DATA_FILE, JSON.stringify(noticias, null, 2));
      res.json({ ok: true });
    });
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

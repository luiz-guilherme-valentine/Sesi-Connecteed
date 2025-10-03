const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const archiver = require("archiver");
const unzipper = require("unzipper");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "noticias.json");

// Garantir arquivo de notícias
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]");

// Multer em memória
const upload = multer({ storage: multer.memoryStorage() });

// --- API ---

// Listar notícias
app.get("/noticias", (req, res) => {
  const noticias = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  res.json(noticias);
});

// Criar notícia
app.post("/noticias", upload.fields([{ name: "pdf" }, { name: "capa" }]), (req, res) => {
  const noticias = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const { titulo, autor, conteudo } = req.body;
  if (!titulo || !autor) return res.status(400).json({ error: "Título e autor obrigatórios" });

  const noticia = {
    id: Date.now(),
    titulo,
    autor,
    conteudo: conteudo || "",
    pdf: req.files.pdf?.[0]?.buffer.toString("base64") || "",
    capa: req.files.capa?.[0]?.buffer.toString("base64") || "",
    data: new Date()
  };

  noticias.push(noticia);
  fs.writeFileSync(DATA_FILE, JSON.stringify(noticias, null, 2));
  res.json({ ok: true });
});

// Deletar notícia
app.delete("/noticias/:id", (req, res) => {
  let noticias = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  noticias = noticias.filter(n => n.id != req.params.id);
  fs.writeFileSync(DATA_FILE, JSON.stringify(noticias, null, 2));
  res.json({ ok: true });
});

// Retornar PDF
app.get("/noticias/:id/arquivo.pdf", (req, res) => {
  const noticias = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const noticia = noticias.find(n => n.id == req.params.id);
  if (!noticia || !noticia.pdf) return res.status(404).send("PDF não encontrado");
  const buffer = Buffer.from(noticia.pdf, "base64");
  res.setHeader("Content-Type", "application/pdf");
  res.send(buffer);
});

// Retornar capa
app.get("/noticias/:id/capa", (req, res) => {
  const noticias = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const noticia = noticias.find(n => n.id == req.params.id);
  if (!noticia || !noticia.capa) return res.status(404).send("Capa não encontrada");
  const buffer = Buffer.from(noticia.capa, "base64");
  res.setHeader("Content-Type", "image/png");
  res.send(buffer);
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

    if (n.pdf) archive.append(Buffer.from(n.pdf, "base64"), { name: `${folder}/arquivo.pdf` });
    if (n.capa) archive.append(Buffer.from(n.capa, "base64"), { name: `${folder}/capa.png` });
  });

  archive.finalize();
});

// --- RESTORE ---
app.post("/restore", upload.single("backup"), async (req, res) => {
  const noticias = [];

  fs.createReadStream(req.file.buffer)
    .pipe(unzipper.Parse())
    .on("entry", async entry => {
      const filePath = entry.path;
      if (filePath.endsWith("info.txt")) {
        const content = await entry.buffer();
        const lines = content.toString().split("\n");
        const titulo = lines[0].replace("Titulo: ", "");
        const autor = lines[1].replace("Autor: ", "");
        noticias.push({
          id: Date.now() + Math.random(),
          titulo,
          autor,
          conteudo: "",
          pdf: "",
          capa: "",
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
                                

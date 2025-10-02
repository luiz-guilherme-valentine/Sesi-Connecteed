import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import archiver from "archiver";
import unzipper from "unzipper";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOADS_DIR = path.join(__dirname, "uploads");
const DB_FILE = path.join(__dirname, "noticias.json");

// Garante diretórios
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "[]");

// Configura uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(UPLOADS_DIR));

// Funções auxiliares
function carregarNoticias() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    return [];
  }
}
function salvarNoticias(noticias) {
  fs.writeFileSync(DB_FILE, JSON.stringify(noticias, null, 2));
}

// Rotas
app.get("/api/noticias", (req, res) => {
  res.json(carregarNoticias());
});

app.post("/api/noticias", upload.fields([{ name: "capa" }, { name: "pdf" }]), (req, res) => {
  const { titulo, autor, conteudo } = req.body;
  const noticias = carregarNoticias();

  const noticia = {
    id: Date.now().toString(),
    titulo,
    autor,
    conteudo,
    capa: req.files["capa"] ? path.join("uploads", req.files["capa"][0].filename) : null,
    pdf: req.files["pdf"] ? path.join("uploads", req.files["pdf"][0].filename) : null
  };

  noticias.push(noticia);
  salvarNoticias(noticias);
  res.json({ success: true, noticia });
});

app.delete("/api/noticias/:id", (req, res) => {
  const { id } = req.params;
  let noticias = carregarNoticias();
  const noticia = noticias.find(n => n.id === id);

  if (!noticia) return res.status(404).json({ error: "Notícia não encontrada" });

  [noticia.capa, noticia.pdf].forEach(file => {
    if (file && fs.existsSync(file)) fs.unlinkSync(file);
  });

  noticias = noticias.filter(n => n.id !== id);
  salvarNoticias(noticias);

  res.json({ success: true });
});

// Backup (gera ZIP com todas as notícias e arquivos)
app.get("/api/backup", (req, res) => {
  const noticias = carregarNoticias();

  res.setHeader("Content-Disposition", "attachment; filename=backup_noticias.zip");
  res.setHeader("Content-Type", "application/zip");

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(res);

  noticias.forEach(noticia => {
    const pasta = `noticia_${noticia.id}`;
    let conteudoTxt = `Título: ${noticia.titulo}\nAutor: ${noticia.autor}\n`;
    if (noticia.conteudo) conteudoTxt += `\nConteúdo:\n${noticia.conteudo}\n`;

    archive.append(conteudoTxt, { name: `${pasta}/dados.txt` });

    if (noticia.capa && fs.existsSync(noticia.capa)) {
      archive.file(noticia.capa, { name: `${pasta}/capa${path.extname(noticia.capa)}` });
    }
    if (noticia.pdf && fs.existsSync(noticia.pdf)) {
      archive.file(noticia.pdf, { name: `${pasta}/arquivo.pdf` });
    }
  });

  archive.finalize();
});

// Restauração de backup
app.post("/api/restaurar", upload.single("backup"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });

  const noticias = [];

  fs.createReadStream(req.file.path)
    .pipe(unzipper.Parse())
    .on("entry", async entry => {
      const filePath = entry.path;
      const parts = filePath.split("/");
      const pasta = parts[0];
      const nomeArquivo = parts[1];

      if (nomeArquivo === "dados.txt") {
        let conteudo = "";
        entry.on("data", d => conteudo += d.toString());
        entry.on("end", () => {
          const id = pasta.replace("noticia_", "");
          const linhas = conteudo.split("\n");
          const titulo = linhas[0].replace("Título: ", "").trim();
          const autor = linhas[1].replace("Autor: ", "").trim();
          const conteudoNoticia = linhas.slice(3).join("\n").trim();

          noticias.push({ id, titulo, autor, conteudo: conteudoNoticia, capa: null, pdf: null });
        });
      } else {
        const destino = path.join(UPLOADS_DIR, Date.now() + "-" + path.basename(filePath));
        entry.pipe(fs.createWriteStream(destino));
        const id = pasta.replace("noticia_", "");
        const noticia = noticias.find(n => n.id === id);
        if (noticia) {
          if (nomeArquivo.startsWith("capa")) noticia.capa = destino;
          if (nomeArquivo.startsWith("arquivo")) noticia.pdf = destino;
        }
      }
    })
    .on("close", () => {
      salvarNoticias(noticias);
      fs.unlinkSync(req.file.path);
      res.json({ success: true, restored: noticias.length });
    });
});

// Servir frontend
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
                

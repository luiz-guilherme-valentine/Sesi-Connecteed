const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const archiver = require("archiver");
const unzipper = require("unzipper");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname)); // serve HTML e outros estáticos da raiz

// --- Pastas ---
const NOTICIAS_DIR = path.join(__dirname, "noticias");
const UPLOADS_DIR = path.join(__dirname, "uploads");

// garante que existam
if (!fs.existsSync(NOTICIAS_DIR)) fs.mkdirSync(NOTICIAS_DIR);
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

// serve arquivos estáticos de notícias (PDFs e imagens)
app.use("/noticias", express.static(NOTICIAS_DIR));

// --- Multer para upload ---
const upload = multer({ dest: UPLOADS_DIR });

// --- Função auxiliar: carregar notícias ---
function carregarNoticias() {
  try {
    const arquivos = fs.readdirSync(NOTICIAS_DIR);
    return arquivos.map(nome => {
      const pasta = path.join(NOTICIAS_DIR, nome);
      const txtPath = path.join(pasta, "dados.txt");
      let titulo = "Sem título";
      let autores = "Desconhecido";
      let conteudo = "";

      if (fs.existsSync(txtPath)) {
        const linhas = fs.readFileSync(txtPath, "utf8").split("\n");
        titulo = linhas[0] || titulo;
        autores = linhas[1] || autores;
        conteudo = linhas.slice(2).join("\n") || "";
      }

      return {
        id: nome,
        titulo,
        autores,
        conteudo,
        capa: fs.existsSync(path.join(pasta, "capa.png")) ? `/noticias/${nome}/capa.png` : null,
        pdf: fs.existsSync(path.join(pasta, "arquivo.pdf")) ? `/noticias/${nome}/arquivo.pdf` : null
      };
    });
  } catch (err) {
    console.error("Erro ao carregar notícias:", err);
    return [];
  }
}

// --- Rotas API ---

// 1. Listar notícias
app.get("/api/noticias", (req, res) => {
  res.json(carregarNoticias());
});

// 2. Criar notícia
const noticiasUpload = multer({ dest: path.join(__dirname, "temp") });
app.post("/api/noticias", noticiasUpload.fields([
  { name: "pdf", maxCount: 1 },
  { name: "capa", maxCount: 1 }
]), (req, res) => {
  const { titulo, autor, conteudo } = req.body;
  if (!titulo || !autor) return res.status(400).json({ error: "Título e autor obrigatórios" });

  const id = Date.now().toString();
  const pasta = path.join(NOTICIAS_DIR, id);
  fs.mkdirSync(pasta);

  fs.writeFileSync(path.join(pasta, "dados.txt"), `${titulo}\n${autor}\n${conteudo || ""}`, "utf8");

  if (req.files.pdf) fs.renameSync(req.files.pdf[0].path, path.join(pasta, "arquivo.pdf"));
  if (req.files.capa) fs.renameSync(req.files.capa[0].path, path.join(pasta, "capa.png"));

  res.json({ message: "Notícia criada", id });
});

// 3. Deletar notícia
app.delete("/api/noticias/:id", (req, res) => {
  const pasta = path.join(NOTICIAS_DIR, req.params.id);
  if (fs.existsSync(pasta)) {
    fs.rmSync(pasta, { recursive: true, force: true });
    return res.json({ message: "Notícia deletada" });
  }
  res.status(404).json({ error: "Notícia não encontrada" });
});

// 4. Fazer backup
app.get("/backup", (req, res) => {
  const zipPath = path.join(__dirname, "backup.zip");
  const output = fs.createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  output.on("close", () => {
    res.download(zipPath, "backup_noticias.zip", (err) => {
      if (err) console.error(err);
      fs.unlinkSync(zipPath);
    });
  });

  archive.pipe(output);
  archive.directory(NOTICIAS_DIR, false);
  archive.finalize();
});

// 5. Restaurar backup
app.post("/restore", upload.single("backup"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });
  const zipPath = req.file.path;

  fs.createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: NOTICIAS_DIR }))
    .on("close", () => {
      fs.unlinkSync(zipPath);
      res.json({ message: "Backup restaurado" });
    })
    .on("error", (err) => {
      console.error(err);
      res.status(500).json({ error: "Falha ao restaurar backup" });
    });
});

app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));

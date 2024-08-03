const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const { SitemapStream, streamToPromise } = require('sitemap');

const app = express();
const port = process.env.PORT || 5000;

const corsOptions = {
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // Allow credentials
};

app.use(cors(corsOptions));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const uri = "mongodb+srv://sahareior:Bafhu6MH1TcEmlPV@cluster0.s4ykc77.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
// const uri = "mongodb://localhost:27017"
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function generateSitemap() {
  try {
    const db = client.db('Neon_net');
    const blogPosts = db.collection('Blog_Posts');
    const posts = await blogPosts.find().toArray();

    const slugify = (text) => {
      return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
    };

    const sitemap = new SitemapStream({ hostname: 'https://yourwebsite.com' });

    sitemap.write({ url: '/', lastmod: new Date() });
    sitemap.write({ url: '/blogs', lastmod: new Date() });

    posts.forEach(post => {
      sitemap.write({ url: `/blogs/${slugify(post.title)}`, lastmod: new Date() });
    });

    sitemap.end();

    const sitemapXml = await streamToPromise(sitemap).then(sm => sm.toString());

    const publicDir = path.join(__dirname, 'public');

    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapXml);
    console.log('Sitemap successfully generated at:', path.join(publicDir, 'sitemap.xml'));
  } catch (err) {
    console.error('Error generating sitemap:', err);
    throw new Error('Error generating sitemap');
  }
}

async function startServer() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
    const db = client.db('Neon_net');
    const blogPosts = db.collection('Blog_Posts');

    app.post('/posts', async (req, res) => {
      const data = req.body;
      try {
        const result = await blogPosts.insertOne(data);
        await generateSitemap();
        res.send(result);
      } catch (err) {
        console.error('Error posting the blog or updating sitemap:', err);
        res.status(500).send('Error posting the blog or updating sitemap.');
      }
    });

    app.get('/blogs', async (req, res) => {
      try {
        const data = await blogPosts.find().toArray();
        res.send(data);
      } catch (err) {
        console.error('Error fetching blog posts:', err);
        res.status(500).send('Error fetching blog posts.');
      }
    });

  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

startServer().catch(console.dir);

app.get('/', (req, res) => {
  res.send("Hello World");
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

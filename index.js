const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const { SitemapStream, streamToPromise } = require('sitemap');

const app = express();
const port = process.env.PORT || 5000;

const corsOptions = {
  origin: 'https://neonnet.netlify.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // Allow credentials
};

app.use(cors(corsOptions));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// const uri ="mongodb://localhost:27017"
const uri = "mongodb+srv://sahareior:Bafhu6MH1TcEmlPV@cluster0.s4ykc77.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
const db = client.db('Neon_net');
const blogPosts = db.collection('Blog_Posts');
const workImages = db.collection('Work-images');

async function generateSitemap() {
  try {
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

    const sitemap = new SitemapStream({ hostname: 'https://neonnet.netlify.app' });

    sitemap.write({ url: '/', lastmod: "2024-08-05T13:47:49.415Z" });
    sitemap.write({ url: '/blogs', lastmod: "2024-08-05T13:47:49.415Z" });

    posts.forEach(post => {
      if (post.title) {  // Ensure that the post has a title
        const slug = slugify(post.title);
        sitemap.write({ url: `/blogs/${slug}`, lastmod: post.lastmod });
      } else {
        console.warn('Post without title encountered:');
      }
    });

    sitemap.end();

    const sitemapXml = await streamToPromise(sitemap).then(sm => sm.toString());

    return sitemapXml;
  } catch (err) {
    console.error('Error generating sitemap:', err);
    throw new Error('Error generating sitemap');
  }
}

async function startServer() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");

    app.post('/posts', async (req, res) => {
      const data = req.body;
      try {
        const result = await blogPosts.insertOne(data);
        // Generate sitemap only after inserting a blog post
        await generateSitemap();
        res.send(result);
      } catch (err) {
        console.error('Error posting the blog or updating sitemap:', err);
        res.status(500).send('Error posting the blog or updating sitemap.');
      }
    });

    app.post('/work', async (req, res) => {
      const data = req.body;
      
      try {
        const result = await workImages.insertOne(data);
        res.send(result); // No sitemap generation here
      } catch (err) {
        console.error('Error posting work image:', err);
        res.status(500).send('Error posting work image.');
      }
    });

    app.get('/work', async (req, res) => {
      try {
        const data = await workImages.find().toArray();
        res.send(data);
      } catch (err) {
        console.error('Error fetching work images:', err);
        res.status(500).send('Error fetching work images.');
      }
    });

    app.delete('/work/:id', async (req, res) => {
      const id = req.params.id;
  
      if (!ObjectId.isValid(id)) {
          return res.status(400).send('Invalid ID format');
      }
  
      try {
          const result = await workImages.deleteOne({ _id: new ObjectId(id) });
  
          if (result.deletedCount === 1) {
              res.status(200).send({ message: 'Image deleted successfully' });
          } else {
              res.status(404).send({ message: 'Image not found' });
          }
      } catch (error) {
          console.error('Error deleting image:', error);
          res.status(500).send('Error deleting image');
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

    app.get('/blogs/:id', async (req, res) => {
      const slug = req.params.id.trim();

      try {
        const titleRegex = new RegExp(`^${slug.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase())}$`, 'i');
        const data = await blogPosts.findOne({ title: titleRegex });

        if (data) {
          res.json(data);
        } else {
          res.status(404).send('Blog post not found');
        }
      } catch (error) {
        console.error('Error fetching blog data:', error);
        res.status(500).send('Error fetching blog data');
      }
    });

    // Serve sitemap dynamically
    app.get('/sitemap.xml', async (req, res) => {
      try {
        const sitemapXml = await generateSitemap();
        res.header('Content-Type', 'application/xml');
        res.send(sitemapXml);
      } catch (err) {
        console.error('Error generating sitemap:', err);
        res.status(500).send('Error generating sitemap.');
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

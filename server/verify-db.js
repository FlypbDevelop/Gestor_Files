const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('=== Verificando Banco de Dados ===\n');

// Check tables
db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (err, tables) => {
  if (err) {
    console.error('Erro ao listar tabelas:', err);
    return;
  }
  
  console.log('Tabelas criadas:');
  tables.forEach(table => console.log(`  - ${table.name}`));
  console.log('');
  
  // Check plans
  db.all("SELECT * FROM plans", (err, plans) => {
    if (err) {
      console.error('Erro ao buscar planos:', err);
      return;
    }
    
    console.log('Planos padrão:');
    plans.forEach(plan => {
      console.log(`  - ${plan.name} (R$ ${plan.price})`);
      const features = JSON.parse(plan.features);
      console.log(`    Max Downloads: ${features.maxDownloadsPerMonth === -1 ? 'Ilimitado' : features.maxDownloadsPerMonth}`);
    });
    console.log('');
    
    // Check admin user
    db.all("SELECT id, name, email, role FROM users WHERE role='ADMIN'", (err, admins) => {
      if (err) {
        console.error('Erro ao buscar admin:', err);
        return;
      }
      
      console.log('Usuários Admin:');
      if (admins.length === 0) {
        console.log('  ⚠️  Nenhum usuário admin encontrado!');
      } else {
        admins.forEach(admin => {
          console.log(`  - ${admin.name} (${admin.email})`);
        });
      }
      console.log('');
      
      // Check total users
      db.get("SELECT COUNT(*) as count FROM users", (err, result) => {
        if (err) {
          console.error('Erro ao contar usuários:', err);
          return;
        }
        
        console.log(`Total de usuários: ${result.count}`);
        console.log('');
        
        db.close();
      });
    });
  });
});

import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

const testBusinesses = [
  {
    business_name: "Tony's Italian Restaurant",
    category: 'Italian Restaurant',
    first_name: 'Tony',
    last_name: 'Russo',
    email: 'tony@tonysitalian.com',
    phone: '+1 (555) 123-4567',
    website: 'https://www.tonysitalian.com',
    address: '123 Main Street',
    city: 'Chicago',
    country: 'US',
    rating: 3.2,
    total_reviews: 87,
    google_profile_url: 'https://www.google.com/maps/place/tonys',
    reviews: [
      {
        rating: 1,
        reviewer_name: 'Sarah Johnson',
        text: 'Terrible service! Waited 45 minutes for cold pasta. The waiter was rude and dismissive when we complained. Will never return.',
        published_date: new Date('2024-01-15'),
      },
      {
        rating: 2,
        reviewer_name: 'Mike Chen',
        text: 'Food was mediocre at best. The marinara sauce tasted like it came from a jar. Overpriced for what you get.',
        published_date: new Date('2024-01-10'),
      },
    ],
  },
  {
    business_name: 'Green Valley Dental Care',
    category: 'Dental Clinic',
    first_name: 'Dr. Emily',
    last_name: 'Stevens',
    email: 'contact@greenvalleydental.com',
    phone: '+1 (555) 234-5678',
    website: 'https://www.greenvalleydental.com',
    address: '456 Oak Avenue',
    city: 'Portland',
    country: 'US',
    rating: 2.8,
    total_reviews: 124,
    google_profile_url: 'https://www.google.com/maps/place/greenvalley',
    reviews: [
      {
        rating: 1,
        reviewer_name: 'David Martinez',
        text: 'Worst dental experience ever. They charged me for procedures I didn\'t need. The dentist was rushed and didn\'t listen to my concerns. Avoid!',
        published_date: new Date('2024-01-20'),
      },
      {
        rating: 2,
        reviewer_name: 'Lisa Brown',
        text: 'Very unprofessional staff. Front desk was rude and billing was a nightmare. Had to call 5 times to get charges explained.',
        published_date: new Date('2024-01-18'),
      },
      {
        rating: 1,
        reviewer_name: 'Robert Taylor',
        text: 'Pain management was terrible. Still hurting 3 days after a simple filling. Called office and they were dismissive.',
        published_date: new Date('2024-01-12'),
      },
    ],
  },
  {
    business_name: 'Elite Fitness Center',
    category: 'Gym & Fitness',
    first_name: 'Marcus',
    last_name: 'Williams',
    email: 'info@elitefitness.com',
    phone: '+1 (555) 345-6789',
    website: 'https://www.elitefitness.com',
    address: '789 Fitness Blvd',
    city: 'Austin',
    country: 'US',
    rating: 3.5,
    total_reviews: 201,
    google_profile_url: 'https://www.google.com/maps/place/elitefitness',
    reviews: [
      {
        rating: 2,
        reviewer_name: 'Jennifer Lee',
        text: 'Equipment is old and broken. Half the machines have "out of order" signs. Not worth the premium price they charge.',
        published_date: new Date('2024-01-22'),
      },
    ],
  },
  {
    business_name: 'Sunset Auto Repair',
    category: 'Auto Repair Shop',
    first_name: 'Carlos',
    last_name: 'Rodriguez',
    email: 'carlos@sunsetauto.com',
    phone: '+1 (555) 456-7890',
    website: 'https://www.sunsetautorepair.com',
    address: '321 Mechanic Lane',
    city: 'San Diego',
    country: 'US',
    rating: 2.1,
    total_reviews: 156,
    google_profile_url: 'https://www.google.com/maps/place/sunsetauto',
    reviews: [
      {
        rating: 1,
        reviewer_name: 'Karen White',
        text: 'SCAM ALERT! They told me I needed $2000 in repairs. Got a second opinion - only needed $300 in work. Dishonest and predatory.',
        published_date: new Date('2024-01-25'),
      },
      {
        rating: 1,
        reviewer_name: 'Tom Anderson',
        text: 'Took my car in for brakes, now my engine light is on! They damaged something and won\'t take responsibility. Avoid at all costs!',
        published_date: new Date('2024-01-19'),
      },
    ],
  },
  {
    business_name: 'Cozy Corner Cafe',
    category: 'Coffee Shop',
    first_name: 'Amanda',
    last_name: 'Peterson',
    email: 'hello@cozycornercafe.com',
    phone: '+1 (555) 567-8901',
    website: 'https://www.cozycornercafe.com',
    address: '555 Brew Street',
    city: 'Seattle',
    country: 'US',
    rating: 4.1,
    total_reviews: 342,
    google_profile_url: 'https://www.google.com/maps/place/cozycorner',
    reviews: [
      {
        rating: 2,
        reviewer_name: 'Chris Miller',
        text: 'Coffee is overpriced and tastes burnt. Staff seemed annoyed when I asked for oat milk. Not the cozy vibe they advertise.',
        published_date: new Date('2024-01-23'),
      },
    ],
  },
]

async function seedTestLeads() {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    console.log('🌱 Seeding test leads with negative reviews...\n')

    for (const business of testBusinesses) {
      // Insert business
      const businessResult = await client.query(
        `INSERT INTO businesses (
          name, category, first_name, last_name, email, phone, website,
          address, city, country_code, rating, reviews_count, lifecycle_stage,
          data_source, entry_method, ready_for_enrichment, google_profile_url,
          place_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING id`,
        [
          business.business_name,
          business.category,
          business.first_name,
          business.last_name,
          business.email,
          business.phone,
          business.website,
          business.address,
          business.city,
          business.country,
          business.rating,
          business.total_reviews,
          'lead', // lifecycle_stage
          'manual', // data_source
          'manual_entry', // entry_method
          true, // ready_for_enrichment
          business.google_profile_url,
          `place_${Math.random().toString(36).substr(2, 9)}`, // random place_id
        ]
      )

      const businessId = businessResult.rows[0].id

      console.log(`✅ Created business: ${business.business_name}`)
      console.log(`   ID: ${businessId}`)
      console.log(`   Contact: ${business.first_name} ${business.last_name}`)
      console.log(`   Reviews to add: ${business.reviews.length}`)

      // Insert reviews
      for (const review of business.reviews) {
        await client.query(
          `INSERT INTO reviews (
            business_id, rating, reviewer_name, text, published_date,
            source, language
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            businessId,
            review.rating,
            review.reviewer_name,
            review.text,
            review.published_date,
            'google', // source
            'en', // language
          ]
        )

        console.log(`   📝 Added review from ${review.reviewer_name} (${review.rating}⭐)`)
      }

      console.log('')
    }

    await client.query('COMMIT')

    console.log('✅ Successfully seeded test leads!')
    console.log(`\n📊 Summary:`)
    console.log(`   Businesses created: ${testBusinesses.length}`)
    console.log(
      `   Total reviews added: ${testBusinesses.reduce((acc, b) => acc + b.reviews.length, 0)}`
    )
    console.log(
      `   Negative reviews (1-2⭐): ${testBusinesses.reduce((acc, b) => acc + b.reviews.filter((r) => r.rating <= 2).length, 0)}`
    )
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Error seeding test leads:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

seedTestLeads()

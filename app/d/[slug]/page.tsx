export default function Page() {
  const data = {
    name: "Dr. Amit Jain",
    profile_pic_url: "https://i.pravatar.cc/150?img=3",
    specialization: "Dentist",
    location: "South Delhi",
    bio: "Experienced dental surgeon",
    instagram: "https://instagram.com/damit",
    linkedIn: "https://linkedin.com/in/amitjaininsead",
    website: "https://amitjain.com",
  }

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold">Welcome, {data.name}</h1>
      <img
        src={data.profile_pic_url}
        alt="Profile"
        className="my-2 w-24 h-24 rounded-full"
      />
      <p><strong>Specialization:</strong> {data.specialization}</p>
      <p><strong>Location:</strong> {data.location}</p>
      <p><strong>Bio:</strong> {data.bio}</p>
      <p><strong>Instagram:</strong> {data.instagram}</p>
      <p><strong>LinkedIn:</strong> {data.linkedIn}</p>
      <p><strong>Website:</strong> {data.website}</p>
    </main>
  )
}

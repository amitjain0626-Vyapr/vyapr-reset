export default function DentistPage({
  params,
}: {
  params: { slug: string };
}) {
  const data = {
    name: "Dr. Amit Jain",
    profile_pic_url: "/profile.jpg",
    specialization: "Cosmetic Dentistry",
    location: "Delhi",
    bio: "20+ years creating perfect smiles.",
    instagram: "@dramit",
    linkedIn: "linkedin.com/in/dramit",
    website: "https://amitjain.com",
  };

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
  );
}

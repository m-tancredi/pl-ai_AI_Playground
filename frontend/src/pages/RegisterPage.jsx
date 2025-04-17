import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register as apiRegister } from '../services/authService'; // Import the API call directly

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      setIsLoading(false);
      return;
    }

    // Prepare data for API (exclude confirmPassword)
    const { confirmPassword, ...apiData } = formData;

    try {
      await apiRegister(apiData);
      setSuccess('Registration successful! Redirecting to login...');
      // Clear form or redirect after a short delay
      setTimeout(() => {
        navigate('/login');
      }, 2000); // 2 second delay
    } catch (err) {
       console.error("Registration page catch:", err);
        let errorMessage = 'Registration failed. Please try again.';
        if (err.response?.data) {
            // Combine multiple errors if backend returns them
            const errors = err.response.data;
            const messages = Object.keys(errors).map(key =>
                `${key.charAt(0).toUpperCase() + key.slice(1)}: ${Array.isArray(errors[key]) ? errors[key].join(', ') : errors[key]}`
            );
            errorMessage = messages.join(' ');
        }
        setError(errorMessage);
        setIsLoading(false); // Stop loading on error
    }
  };

  return (
    <div className="flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Register</h2>
        {error && <p className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</p>}
        {success && <p className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">{success}</p>}
        <form onSubmit={handleSubmit}>
          {/* Username */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="username">Username <span className="text-red-500">*</span></label>
            <input className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500" id="username" name="username" type="text" value={formData.username} onChange={handleChange} required />
          </div>
          {/* Email */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">Email <span className="text-red-500">*</span></label>
            <input className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500" id="email" name="email" type="email" value={formData.email} onChange={handleChange} required autoComplete="email"/>
          </div>
           {/* First Name (Optional) */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="first_name">First Name</label>
            <input className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500" id="first_name" name="first_name" type="text" value={formData.first_name} onChange={handleChange} />
          </div>
          {/* Last Name (Optional) */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="last_name">Last Name</label>
            <input className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500" id="last_name" name="last_name" type="text" value={formData.last_name} onChange={handleChange} />
          </div>
          {/* Password */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">Password <span className="text-red-500">*</span></label>
            <input className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500" id="password" name="password" type="password" value={formData.password} onChange={handleChange} required autoComplete="new-password" />
          </div>
          {/* Confirm Password */}
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="confirmPassword">Confirm Password <span className="text-red-500">*</span></label>
            <input className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500" id="confirmPassword" name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} required autoComplete="new-password"/>
          </div>
          {/* Submit Button */}
          <div className="flex items-center justify-between">
            <button className={`w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-300 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} type="submit" disabled={isLoading}>
              {isLoading ? 'Registering...' : 'Register'}
            </button>
          </div>
        </form>
         <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                Login here
            </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
# Use a slim Python image to keep it small
FROM python:3.11-slim

# Set the working directory
WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your files
COPY . .

# Expose the port FastAPI runs on
EXPOSE 8000

# Run the application
CMD ["python", "main.py"]
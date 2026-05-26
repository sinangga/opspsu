import pandas as pd
import matplotlib.pyplot as plt
from windrose import WindroseAxes
import sys
import os
import numpy as np

# Args: csv_file, output_file
csv_file = sys.argv[1]
output_file = sys.argv[2]

# Load and prepare data
df = pd.read_csv(csv_file)

# Ensure relevant columns exist and convert to numeric
dir_col = 'wind_direction_prevailing_60'
speed_col = 'wind_speed_max_60'

if dir_col not in df.columns or speed_col not in df.columns:
    print(f"Error: Required columns {dir_col} or {speed_col} not found.")
    sys.exit(1)

df[dir_col] = pd.to_numeric(df[dir_col], errors='coerce')
df[speed_col] = pd.to_numeric(df[speed_col], errors='coerce')

# Drop missing values
df = df.dropna(subset=[dir_col, speed_col])

if df.empty:
    print("Error: No valid data available for windrose.")
    sys.exit(1)

# Calculate summary
max_speed_ms = df[speed_col].max()
max_speed_kt = max_speed_ms * 1.94384
# Calculate dominant direction
# 8 sectors for 360 degrees: N, NE, E, SE, S, SW, W, NW
# Edges: 0, 45, 90, 135, 180, 225, 270, 315, 360
bins = [0, 22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5, 360]
labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "N"]
df['sector'] = pd.cut(df[dir_col], bins=bins, labels=labels, ordered=False)
dominant_dir = df['sector'].mode()[0]

# Create Windrose
ax = WindroseAxes.from_ax()
ax.bar(df[dir_col], df[speed_col], normed=True, opening=0.8, edgecolor='white', nsector=8)
ax.set_legend(title="Speed (m/s)", loc='best')

plt.savefig(output_file)
plt.close() # Close figure to free memory
print(f"Saved to {output_file}")
print(f"Summary: Dominant={dominant_dir}, MaxSpeed={max_speed_kt:.1f}")

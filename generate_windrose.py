import pandas as pd
import matplotlib.pyplot as plt
from windrose import WindroseAxes
import sys
import os

# Args: csv_file, output_file
csv_file = sys.argv[1]
output_file = sys.argv[2]

df = pd.read_csv(csv_file)
# Assumes columns 'wind_direction_prevailing_60' and 'wind_speed_max_60'
# Need to clean data
df = df.dropna(subset=['wind_direction_prevailing_60', 'wind_speed_max_60'])

ax = WindroseAxes.from_ax()
ax.bar(df['wind_direction_prevailing_60'], df['wind_speed_max_60'], normed=True, opening=0.8, edgecolor='white')
ax.set_legend(title="Speed (m/s)", loc='best')

plt.savefig(output_file)
print(f"Saved to {output_file}")
